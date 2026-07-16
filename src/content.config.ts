import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const memoria = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/memoria" }),
  schema: ({ image }) =>
    z.object({
      src: image(),
      alt: z.string(),
      year: z.string().optional(),
      yearCertain: z.boolean().default(false),
      lugar: z.string().optional(),
      descripcion: z.string(),
      tags: z.array(z.string()).default([]),
      decada: z.string(), // "1930", "1950", "desconocida"
      decadaLabel: z.string(), // "Años 30 – 40"
      order: z.number().default(0), // orden dentro de la década
      aportadaPor: z.string().optional(),
      enlaceUrl: z.string().url().optional(),
      enlaceTexto: z.string().optional(),
    }),
});

export const collections = { memoria };

