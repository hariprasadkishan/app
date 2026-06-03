import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import corsOptions from "./config/cors.config.js";
import helmetOptions from "./config/helmet.config.js";

const app = express();

app.use(helmet(helmetOptions)); 
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

export default app;