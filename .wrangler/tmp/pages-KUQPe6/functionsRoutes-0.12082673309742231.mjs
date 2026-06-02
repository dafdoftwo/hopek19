import { onRequestGet as __api_orders_js_onRequestGet } from "/Users/ahmedsalem/Downloads/hope-k19/functions/api/orders.js"
import { onRequestOptions as __api_orders_js_onRequestOptions } from "/Users/ahmedsalem/Downloads/hope-k19/functions/api/orders.js"
import { onRequestPost as __api_orders_js_onRequestPost } from "/Users/ahmedsalem/Downloads/hope-k19/functions/api/orders.js"

export const routes = [
    {
      routePath: "/api/orders",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_orders_js_onRequestGet],
    },
  {
      routePath: "/api/orders",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_orders_js_onRequestOptions],
    },
  {
      routePath: "/api/orders",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_orders_js_onRequestPost],
    },
  ]