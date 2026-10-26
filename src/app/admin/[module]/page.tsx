import Gate from "@/components/gate";
import {
  Services,
  Clients,
  Professionals,
  Inventory,
  Hours,
  Settings,
} from "@/components/operations";
import Agenda from "@/components/agenda";
import Payments from "@/components/payments";
import Finance from "@/components/finance";
import BookingForm from "@/components/booking-form";
import { notFound } from "next/navigation";
import type { Role } from "@/lib/access";
const modules: Record<
  string,
  { title: string; roles: Role[]; view: React.ReactNode }
> = {
  servicos: { title: "Serviços", roles: ["manager"], view: <Services /> },
  clientes: {
    title: "Clientes",
    roles: ["manager", "reception"],
    view: <Clients />,
  },
  profissionais: {
    title: "Profissionais",
    roles: ["manager"],
    view: <Professionals />,
  },
  inventario: {
    title: "Produtos e materiais",
    roles: ["manager"],
    view: <Inventory />,
  },
  horarios: {
    title: "Horários e indisponibilidades",
    roles: ["manager", "professional"],
    view: <Hours />,
  },
  definicoes: { title: "Definições", roles: ["manager"], view: <Settings /> },
  agenda: {
    title: "Agenda e marcações",
    roles: ["manager", "reception", "professional"],
    view: <Agenda />,
  },
  pagamentos: {
    title: "Pagamentos",
    roles: ["manager", "reception"],
    view: <Payments />,
  },
  financas: { title: "Finanças", roles: ["manager"], view: <Finance /> },
  "nova-marcacao": {
    title: "Marcação pela recepção",
    roles: ["manager", "reception"],
    view: <BookingForm staff />,
  },
};
export default async function Module({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const config = modules[module];
  if (!config) notFound();
  return (
    <Gate roles={config.roles}>
      <div className="pagehead">
        <div className="eyebrow">Gestão · InfoSalão</div>
        <h1>{config.title}</h1>
      </div>
      {config.view}
    </Gate>
  );
}
