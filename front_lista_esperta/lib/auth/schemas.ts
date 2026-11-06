import { z } from "zod";

const email = z
  .string()
  .trim()
  .min(1, "Informe seu e-mail.")
  .pipe(z.email("Informe um e-mail válido, como nome@exemplo.com."));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Informe sua senha."),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  role: z.enum(["SHOPPER", "MERCHANT"], { error: "Escolha como você vai usar o app." }),
  displayName: z.string().trim().min(1, "Informe seu nome.").max(80, "Use no máximo 80 caracteres."),
  email,
  password: z.string().min(8, "Use pelo menos 8 caracteres.").max(128, "Use no máximo 128 caracteres."),
});
export type RegisterValues = z.infer<typeof registerSchema>;

export const preferencesSchema = z.object({
  displayName: z.string().trim().min(1, "Informe seu nome.").max(80, "Use no máximo 80 caracteres."),
  defaultRadiusKm: z
    .number({ error: "Informe um número." })
    .min(0.5, "Use pelo menos 0,5 km.")
    .max(50, "Use no máximo 50 km."),
});
export type PreferencesValues = z.infer<typeof preferencesSchema>;
