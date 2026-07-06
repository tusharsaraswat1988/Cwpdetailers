import { Redirect } from "wouter";

/** Legacy route — team lives in Profile now. */
export default function StaffTeam() {
  return <Redirect to="/staff/profile" />;
}
