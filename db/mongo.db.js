import mongoose from "mongoose";
import { DB_NAME } from "../src/constants.js";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URL}/${DB_NAME}`
    );

    console.log("====================================");
    console.log(
      `MongoDB connected || Host: ${connectionInstance.connection.host}`
    );
    console.log("====================================");
  } catch (error) {
    console.error("MONGODB connection error | Error: ", error);
    process.exit(1);
  }
};

export default connectDB;
