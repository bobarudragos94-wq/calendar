import EventClient from "./EventClient";

export const dynamic = "force-dynamic";

export default function EventPage({ params }: { params: { code: string } }) {
  return <EventClient code={params.code.toUpperCase()} />;
}
