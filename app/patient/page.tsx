import { PatientView } from "@/components/PatientView";
import { QueueChrome } from "@/components/QueueChrome";

export default function PatientPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token ? Number(searchParams.token) : 0;

  return (
    <QueueChrome>
      <PatientView initialToken={Number.isFinite(token) && token > 0 ? token : 0} />
    </QueueChrome>
  );
}
