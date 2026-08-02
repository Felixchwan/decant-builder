const routes = ["", "/como-funciona", "/catalogo", "/build-your-box", "/contacto"];

export default function sitemap() {
  return routes.map((route) => ({ url: `https://aurelianperfumes.com${route}`, changeFrequency: route === "" ? "weekly" : "monthly", priority: route === "" ? 1 : 0.8 }));
}
