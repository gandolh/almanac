import { serializerCompiler, validatorCompiler } from "@fastify/type-provider-zod";
import Fastify, { type FastifyInstance, type FastifyPluginAsync } from "fastify";
import type { AuthContext } from "../../vendor/ward/ward-auth.js";
import { errors } from "../plugins/errors.js";

/**
 * One feature alone, on a bare Fastify with the zod compilers and the error
 * plugin, signed in as `userId` without the session library, and its
 * dependencies (a store) faked through its options. For the cases a whole app
 * can't reach: a store row with a field the reply schema doesn't name, or a
 * value it doesn't allow.
 */
export async function featureApp<Options extends object>(
  plugin: FastifyPluginAsync<Options>,
  options: Options,
  userId = "user-1",
): Promise<FastifyInstance> {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(errors);
  app.decorateRequest("auth", null);
  app.addHook("onRequest", async (request) => {
    request.auth = { user: { id: userId, username: "test", role: "user", hasPassword: true } } as AuthContext;
  });
  await app.register(plugin, options);
  return app;
}
