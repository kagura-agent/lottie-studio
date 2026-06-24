export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Minimal layout — no nav, no providers beyond what root layout supplies.
  // The embed page handles its own full-viewport styling.
  return children;
}
