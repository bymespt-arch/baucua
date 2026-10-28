import { createFileRoute } from "@tanstack/react-router";
import { BauCuaApp } from "@/components/bau-cua-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <BauCuaApp />;
}
