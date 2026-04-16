import { createApp } from "vue";
import { createPinia } from "pinia";

import App from "./App.vue";
import { router, setupRouterGuards } from "./router";
import "./style.css";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
setupRouterGuards();
app.use(router);
app.mount("#app");
