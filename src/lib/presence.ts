import { createServerFn } from "@tanstack/react-start";

export const beatPresence = createServerFn({ method: "POST" })
  .validator((input: { id: string; leave?: boolean }) => {
    const id = typeof input?.id === "string" ? input.id : "";
    return { id, leave: input?.leave === true };
  })
  .handler(async ({ data }) => {
    const { touchPresence } = await import("./presence.server");
    return { online: touchPresence(data.id, data.leave) };
  });
