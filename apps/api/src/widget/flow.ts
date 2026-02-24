import type { Prisma } from "@prisma/client";

type FlowNodeBase = {
  id: string;
  type: string;
  nextNodeId?: string;
};

type MessageNode = FlowNodeBase & {
  type: "message";
  text: string;
};

type QuestionNode = FlowNodeBase & {
  type: "question";
  prompt: string;
  fieldKey: string;
  inputType: string;
  required?: boolean;
};

type EndNode = FlowNodeBase & {
  type: "end";
};

type FlowNode = MessageNode | QuestionNode | EndNode;

export type FlowGraph = {
  startNodeId: string;
  nodes: FlowNode[];
};

export type PublicQuestion = {
  id: string;
  prompt: string;
  field_key: string;
  input_type: string;
  required: boolean;
};

export type FlowProgress = {
  botMessages: string[];
  currentNodeId: string | null;
  nextQuestion: PublicQuestion | null;
  completed: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toFlowNode = (value: unknown): FlowNode | null => {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.type !== "string") {
    return null;
  }

  if (value.type === "message" && typeof value.text === "string") {
    return {
      id: value.id,
      type: "message",
      text: value.text,
      nextNodeId: typeof value.nextNodeId === "string" ? value.nextNodeId : undefined
    };
  }

  if (
    value.type === "question" &&
    typeof value.prompt === "string" &&
    typeof value.fieldKey === "string" &&
    typeof value.inputType === "string"
  ) {
    return {
      id: value.id,
      type: "question",
      prompt: value.prompt,
      fieldKey: value.fieldKey,
      inputType: value.inputType,
      required: value.required === true,
      nextNodeId: typeof value.nextNodeId === "string" ? value.nextNodeId : undefined
    };
  }

  if (value.type === "end") {
    return {
      id: value.id,
      type: "end",
      nextNodeId: typeof value.nextNodeId === "string" ? value.nextNodeId : undefined
    };
  }

  return null;
};

export const parseFlowGraph = (graphJson: Prisma.JsonValue): FlowGraph | null => {
  if (!isRecord(graphJson)) {
    return null;
  }

  if (typeof graphJson.startNodeId !== "string" || !Array.isArray(graphJson.nodes)) {
    return null;
  }

  const nodes: FlowNode[] = [];

  for (const node of graphJson.nodes) {
    const parsedNode = toFlowNode(node);

    if (!parsedNode) {
      return null;
    }

    nodes.push(parsedNode);
  }

  return {
    startNodeId: graphJson.startNodeId,
    nodes
  };
};

const toPublicQuestion = (node: QuestionNode): PublicQuestion => ({
  id: node.id,
  prompt: node.prompt,
  field_key: node.fieldKey,
  input_type: node.inputType,
  required: node.required === true
});

const buildNodeMap = (graph: FlowGraph): Map<string, FlowNode> => {
  const nodeMap = new Map<string, FlowNode>();

  for (const node of graph.nodes) {
    nodeMap.set(node.id, node);
  }

  return nodeMap;
};

export const runLinearFlow = (graph: FlowGraph, fromNodeId: string | null): FlowProgress => {
  if (!fromNodeId) {
    return {
      botMessages: [],
      currentNodeId: null,
      nextQuestion: null,
      completed: true
    };
  }

  const nodeMap = buildNodeMap(graph);
  const botMessages: string[] = [];
  let currentNodeId: string | null = fromNodeId;

  while (currentNodeId) {
    const node = nodeMap.get(currentNodeId);

    if (!node) {
      return {
        botMessages,
        currentNodeId: null,
        nextQuestion: null,
        completed: true
      };
    }

    if (node.type === "message") {
      botMessages.push(node.text);
      currentNodeId = node.nextNodeId ?? null;
      continue;
    }

    if (node.type === "question") {
      return {
        botMessages,
        currentNodeId: node.id,
        nextQuestion: toPublicQuestion(node),
        completed: false
      };
    }

    if (node.type === "end") {
      return {
        botMessages,
        currentNodeId: null,
        nextQuestion: null,
        completed: true
      };
    }
  }

  return {
    botMessages,
    currentNodeId: null,
    nextQuestion: null,
    completed: true
  };
};

export const getNodeById = (graph: FlowGraph, nodeId: string | null): FlowNode | null => {
  if (!nodeId) {
    return null;
  }

  return graph.nodes.find((node) => node.id === nodeId) ?? null;
};

