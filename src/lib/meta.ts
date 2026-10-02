export const meta = (title: string, description: string) => ({
  meta: [
    { title: `${title} · Almoxarifado Drilling` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} · Almoxarifado Drilling` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ],
});
