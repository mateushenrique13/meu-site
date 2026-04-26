import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/loginmateus")

  const [notes, tasks, links] = await Promise.all([
    prisma.note.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" } }),
    prisma.task.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" } }),
    prisma.link.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" } }),
  ])

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <h1 className="text-3xl font-light tracking-widest">painel pessoal</h1>
          <form action={async () => {
            "use server"
            const { signOut } = await import("@/auth")
            await signOut({ redirectTo: "/" })
          }}>
            <button className="text-white/40 text-sm hover:text-white transition">sair</button>
          </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* Notas */}
          <div className="border border-white/10 rounded-xl p-6">
            <h2 className="text-sm tracking-widest text-white/50 mb-4">notas</h2>
            {notes.length === 0 && <p className="text-white/20 text-sm">nenhuma nota ainda</p>}
            <ul className="flex flex-col gap-3">
              {notes.map(note => (
                <li key={note.id} className="border border-white/10 rounded-lg p-3">
                  <p className="text-sm font-medium">{note.title}</p>
                  <p className="text-xs text-white/40 mt-1">{note.content}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Tarefas */}
          <div className="border border-white/10 rounded-xl p-6">
            <h2 className="text-sm tracking-widest text-white/50 mb-4">tarefas</h2>
            {tasks.length === 0 && <p className="text-white/20 text-sm">nenhuma tarefa ainda</p>}
            <ul className="flex flex-col gap-3">
              {tasks.map(task => (
                <li key={task.id} className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border ${task.done ? "bg-white border-white" : "border-white/30"}`}/>
                  <span className={`text-sm ${task.done ? "line-through text-white/30" : ""}`}>{task.title}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Links */}
          <div className="border border-white/10 rounded-xl p-6">
            <h2 className="text-sm tracking-widest text-white/50 mb-4">links</h2>
            {links.length === 0 && <p className="text-white/20 text-sm">nenhum link ainda</p>}
            <ul className="flex flex-col gap-3">
              {links.map(link => (
                <li key={link.id}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-white/60 hover:text-white transition">
                    {link.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </main>
  )
}