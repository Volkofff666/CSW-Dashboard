import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { prisma } from "../lib/prisma.js";
import { getNodeById, parseFlowGraph, runLinearFlow } from "../widget/flow.js";

type WidgetConfigQuery = {
  site_key: string;
};

type StartConversationBody = {
  site_key: string;
  visitor_id: string;
  idempotency_key?: string;
};

type SubmitAnswerBody = {
  conversation_id: string;
  answer: string | number | boolean;
};

const badRequest = (reply: FastifyReply, message: string) =>
  reply.code(400).send({ error: "bad_request", message });

const notFound = (reply: FastifyReply, message: string) =>
  reply.code(404).send({ error: "not_found", message });

const asAnswersRecord = (value: unknown): Record<string, string> => {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => typeof entryValue === "string")
    .map(([entryKey, entryValue]) => [entryKey, entryValue as string]);

  return Object.fromEntries(entries);
};

const asMeta = (value: unknown): { answers: Record<string, string> } => {
  if (typeof value !== "object" || value === null) {
    return { answers: {} };
  }

  const meta = value as Record<string, unknown>;
  const answers = asAnswersRecord(meta.answers);

  return { answers };
};

const toLeadPayload = (answers: Record<string, string>) => ({
  name: answers.name ?? null,
  emailEnc: answers.email ?? null,
  phoneEnc: answers.phone ?? null,
  fieldsJson: answers
});

export const registerWidgetRoutes = (app: FastifyInstance): void => {
  app.get<{ Querystring: WidgetConfigQuery }>(
    "/v1/widget/config",
    async (request: FastifyRequest<{ Querystring: WidgetConfigQuery }>, reply) => {
      const siteKey = request.query.site_key?.trim();

      if (!siteKey) {
        return badRequest(reply, "site_key is required");
      }

      const site = await prisma.site.findUnique({
        where: { publicKey: siteKey },
        include: {
          widgetConfig: true
        }
      });

      if (!site) {
        return notFound(reply, "site not found");
      }

      const activeFlow = await prisma.flow.findFirst({
        where: { siteId: site.id, isActive: true },
        orderBy: { updatedAt: "desc" }
      });

      const parsedFlow = activeFlow ? parseFlowGraph(activeFlow.graphJson) : null;
      const flowPreview =
        parsedFlow && activeFlow
          ? runLinearFlow(parsedFlow, parsedFlow.startNodeId)
          : {
              botMessages: [],
              nextQuestion: null
            };

      return {
        site: {
          id: site.id,
          domain: site.domain,
          key: site.publicKey
        },
        widget: site.widgetConfig?.settingsJson ?? {},
        flow: activeFlow
          ? {
              id: activeFlow.id,
              name: activeFlow.name,
              start_node_id: parsedFlow?.startNodeId ?? null,
              nodes_count: parsedFlow?.nodes.length ?? 0,
              preview_messages: flowPreview.botMessages,
              first_question: flowPreview.nextQuestion
            }
          : null
      };
    }
  );

  app.post<{ Body: StartConversationBody }>(
    "/v1/widget/conversations",
    async (request: FastifyRequest<{ Body: StartConversationBody }>, reply) => {
      const { site_key: siteKey, visitor_id: visitorId, idempotency_key: idempotencyKey } = request.body;

      if (!siteKey || !visitorId) {
        return badRequest(reply, "site_key and visitor_id are required");
      }

      const site = await prisma.site.findUnique({
        where: { publicKey: siteKey }
      });

      if (!site) {
        return notFound(reply, "site not found");
      }

      const activeFlow = await prisma.flow.findFirst({
        where: { siteId: site.id, isActive: true },
        orderBy: { updatedAt: "desc" }
      });

      if (!activeFlow) {
        return notFound(reply, "active flow not found");
      }

      const flowGraph = parseFlowGraph(activeFlow.graphJson);

      if (!flowGraph) {
        return badRequest(reply, "flow graph is invalid");
      }

      if (idempotencyKey) {
        const existingConversation = await prisma.conversation.findFirst({
          where: {
            siteId: site.id,
            clientEventId: idempotencyKey
          }
        });

        if (existingConversation) {
          const node = getNodeById(flowGraph, existingConversation.currentNodeId);

          return {
            conversation_id: existingConversation.id,
            status: existingConversation.status,
            current_node_id: existingConversation.currentNodeId,
            next_question: node?.type === "question" ? runLinearFlow(flowGraph, node.id).nextQuestion : null,
            replayed: true
          };
        }
      }

      const progress = runLinearFlow(flowGraph, flowGraph.startNodeId);

      const conversation = await prisma.$transaction(async (tx) => {
        const createdConversation = await tx.conversation.create({
          data: {
            siteId: site.id,
            visitorId,
            clientEventId: idempotencyKey ?? null,
            status: progress.completed ? "COMPLETED" : "IN_FLOW",
            currentNodeId: progress.currentNodeId,
            metaJson: { answers: {} }
          }
        });

        if (progress.botMessages.length > 0) {
          await tx.message.createMany({
            data: progress.botMessages.map((text) => ({
              conversationId: createdConversation.id,
              senderType: "bot",
              text
            }))
          });
        }

        if (progress.completed) {
          await tx.lead.create({
            data: {
              siteId: site.id,
              conversationId: createdConversation.id,
              status: "NEW",
              fieldsJson: {}
            }
          });
        }

        return createdConversation;
      });

      return {
        conversation_id: conversation.id,
        status: conversation.status,
        current_node_id: conversation.currentNodeId,
        bot_messages: progress.botMessages,
        next_question: progress.nextQuestion,
        replayed: false
      };
    }
  );

  app.post<{ Body: SubmitAnswerBody }>(
    "/v1/widget/answers",
    async (request: FastifyRequest<{ Body: SubmitAnswerBody }>, reply) => {
      const { conversation_id: conversationId, answer } = request.body;

      if (!conversationId) {
        return badRequest(reply, "conversation_id is required");
      }

      if (answer === undefined || answer === null || `${answer}`.trim() === "") {
        return badRequest(reply, "answer must be non-empty");
      }

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { site: true }
      });

      if (!conversation) {
        return notFound(reply, "conversation not found");
      }

      const activeFlow = await prisma.flow.findFirst({
        where: { siteId: conversation.siteId, isActive: true },
        orderBy: { updatedAt: "desc" }
      });

      if (!activeFlow) {
        return notFound(reply, "active flow not found");
      }

      const flowGraph = parseFlowGraph(activeFlow.graphJson);

      if (!flowGraph) {
        return badRequest(reply, "flow graph is invalid");
      }

      const currentNode = getNodeById(flowGraph, conversation.currentNodeId);

      if (!currentNode || currentNode.type !== "question") {
        return badRequest(reply, "conversation is not waiting for question answer");
      }

      const meta = asMeta(conversation.metaJson);
      const answerText = `${answer}`;
      const nextAnswers = {
        ...meta.answers,
        [currentNode.fieldKey]: answerText
      };

      const progress = runLinearFlow(flowGraph, currentNode.nextNodeId ?? null);

      const result = await prisma.$transaction(async (tx) => {
        await tx.message.create({
          data: {
            conversationId: conversation.id,
            senderType: "visitor",
            text: answerText
          }
        });

        if (progress.botMessages.length > 0) {
          await tx.message.createMany({
            data: progress.botMessages.map((text) => ({
              conversationId: conversation.id,
              senderType: "bot",
              text
            }))
          });
        }

        const updatedConversation = await tx.conversation.update({
          where: { id: conversation.id },
          data: {
            metaJson: { answers: nextAnswers },
            currentNodeId: progress.currentNodeId,
            status: progress.completed ? "COMPLETED" : "IN_FLOW"
          }
        });

        let createdLeadId: string | null = null;

        if (progress.completed) {
          const existingLead = await tx.lead.findUnique({
            where: { conversationId: conversation.id }
          });

          if (!existingLead) {
            const leadPayload = toLeadPayload(nextAnswers);
            const createdLead = await tx.lead.create({
              data: {
                siteId: conversation.siteId,
                conversationId: conversation.id,
                name: leadPayload.name,
                emailEnc: leadPayload.emailEnc,
                phoneEnc: leadPayload.phoneEnc,
                fieldsJson: leadPayload.fieldsJson,
                status: "NEW"
              }
            });
            createdLeadId = createdLead.id;
          } else {
            createdLeadId = existingLead.id;
          }
        }

        return {
          conversation: updatedConversation,
          leadId: createdLeadId
        };
      });

      return {
        conversation_id: result.conversation.id,
        status: result.conversation.status,
        current_node_id: result.conversation.currentNodeId,
        bot_messages: progress.botMessages,
        next_question: progress.nextQuestion,
        lead_id: result.leadId
      };
    }
  );
};
