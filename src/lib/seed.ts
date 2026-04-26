import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

async function main() {
  const hash = await bcrypt.hash("M@tvw2444631", 12)

  await prisma.user.upsert({
    where: { email: "ma0987654321mateus@gmail.com" },
    update: {},
    create: {
      email: "ma0987654321mateus@gmail.com",
      password: hash,
    },
  })

  console.log("Usuário criado com sucesso!")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())