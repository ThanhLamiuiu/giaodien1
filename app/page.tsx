import { redirect } from "next/navigation";

// The real prototype is pure HTML/CSS/JS in room-allocation/ (copied to public/).
export default function Page() {
  redirect("/room-allocation/index.html");
}
