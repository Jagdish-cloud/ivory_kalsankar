import { Badge } from "@/components/ui/Badge";
import type { VerificationStatus } from "@/types/returns";

export function VerificationBadge({ status }: { status: VerificationStatus | "PARTIAL" }) {
  switch (status) {
    case "VERIFIED":
      return <Badge tone="success">Verified - stock added</Badge>;
    case "REJECTED":
      return <Badge tone="danger">Rejected - not restocked</Badge>;
    case "PARTIAL":
      return <Badge tone="brand">Partly verified</Badge>;
    default:
      return <Badge tone="warning">Pending verification</Badge>;
  }
}
