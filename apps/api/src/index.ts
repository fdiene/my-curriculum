import { app } from "./app";

const port = Number(process.env.PORT ?? 3000);
app.listen(port);
console.log(`Profile Engine API on http://localhost:${port}  (swagger: /swagger)`);
