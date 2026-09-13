import { PatientView } from "@/components/PatientView";
import { QueueChrome } from "@/components/QueueChrome";

export default function PatientPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = Number(searchParams.token ?? 1);

  return (
    <QueueChrome>
      <PatientView initialToken={Number.isFinite(token) ? token : 1} />
    </QueueChrome>
  );
}
