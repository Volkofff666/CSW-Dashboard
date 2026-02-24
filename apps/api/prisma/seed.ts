import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const demoFlowGraph = {
  startNodeId: "welcome",
  nodes: [
    {
      id: "welcome",
      type: "message",
      text: "Подберу решение за 30 секунд.",
      nextNodeId: "service"
    },
    {
      id: "service",
      type: "question",
      prompt: "Какая услуга вас интересует?",
      fieldKey: "service_type",
      inputType: "select",
      required: true,
      nextNodeId: "timeline"
    },
    {
      id: "timeline",
      type: "question",
      prompt: "Когда хотите стартовать?",
      fieldKey: "timeline",
      inputType: "text",
      required: true,
      nextNodeId: "budget"
    },
    {
      id: "budget",
      type: "question",
      prompt: "Какой у вас бюджет?",
      fieldKey: "budget",
      inputType: "text",
      required: true,
      nextNodeId: "email"
    },
    {
      id: "email",
      type: "question",
      prompt: "Оставьте email для связи",
      fieldKey: "email",
      inputType: "email",
      required: true,
      nextNodeId: "end"
    },
    {
      id: "end",
      type: "end"
    }
  ]
};

const run = async (): Promise<void> => {
  const account =
    (await prisma.account.findFirst({
      where: { name: "Demo SMB Account" }
    })) ??
    (await prisma.account.create({
      data: { name: "Demo SMB Account" }
    }));

  const site =
    (await prisma.site.findUnique({
      where: { publicKey: "demo_site_key" }
    })) ??
    (await prisma.site.create({
      data: {
        accountId: account.id,
        domain: "demo.local",
        publicKey: "demo_site_key"
      }
    }));

  await prisma.widgetConfig.upsert({
    where: { siteId: site.id },
    update: {
      settingsJson: {
        welcomeText: "Подберу решение за 30 секунд",
        position: "bottom-right",
        primaryColor: "#111111"
      }
    },
    create: {
      siteId: site.id,
      settingsJson: {
        welcomeText: "Подберу решение за 30 секунд",
        position: "bottom-right",
        primaryColor: "#111111"
      }
    }
  });

  await prisma.flow.updateMany({
    where: { siteId: site.id, isActive: true },
    data: { isActive: false }
  });

  await prisma.flow.create({
    data: {
      siteId: site.id,
      name: "Demo Linear Flow",
      graphJson: demoFlowGraph,
      isActive: true
    }
  });

  console.log("Seed complete:");
  console.log("site_key: demo_site_key");
};

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

