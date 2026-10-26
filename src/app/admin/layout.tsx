import Gate from "@/components/gate";
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Gate roles={["manager", "reception", "professional"]}>{children}</Gate>
  );
}
