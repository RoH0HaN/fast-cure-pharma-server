import { model, Schema } from "mongoose";
import jwt from "jsonwebtoken";

const userSchema = new Schema(
  {
    empId: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["TBM", "ABM", "RBM", "ZBM", "HR/OH", "ADMIN"],
      required: true,
    },
    mobile: {
      type: String,
      required: true,
    },
    headquarter: {
      type: String,
      required: true,
      uppercase: true,
    },
  },
  { timestamps: true }
);

userSchema.methods.generateAccessToken = async function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      role: this.role,
      empId: this.empId,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

const User = model("User", userSchema);

const commonDetails = {
  basicDetails: {
    pan: {
      type: String,
      trim: true,
      default: "",
    },
    aadhaar: {
      type: String,
      trim: true,
      default: "",
      uppercase: true,
    },
    dateOfBirth: {
      type: String,
      required: true,
    },
    fatherName: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    dateOfJoining: {
      type: String,
      required: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    parentRole: {
      type: String,
      default: "",
      uppercase: true,
    },
    parentName: {
      type: String,
      trim: true,
      default: "",
      uppercase: true,
    },
  },
  distanceAllowanceDetails: {
    hq: {
      type: Number,
      default: 0,
    },
    ex: {
      type: Number,
      default: 0,
    },
    out: {
      type: Number,
      default: 0,
    },
    hillEx: {
      type: Number,
      default: 0,
    },
    hillOut: {
      type: Number,
      default: 0,
    },
    tAll: {
      type: Number,
      default: 0,
    },
    iAll: {
      type: Number,
      default: 0,
    },
    mobileAll: {
      type: Number,
      default: 0,
    },
  },
  salaryStructure: {
    basic: {
      type: Number,
      default: 0,
    },
    hra: {
      type: Number,
      default: 0,
    },
    conAll: {
      type: Number,
      default: 0,
    },
    eduAll: {
      type: Number,
      default: 0,
    },
    speAll: {
      type: Number,
      default: 0,
    },
    medAll: {
      type: Number,
      default: 0,
    },
    pfNo: {
      type: String,
      default: "",
    },
    bankAccNo: {
      type: String,
      default: "",
    },
    ifscCode: {
      type: String,
      default: "",
    },
    esiNo: {
      type: String,
      default: "",
    },
  },
  isArchived: {
    type: Boolean,
    default: false,
  },
};

const Manager = User.discriminator(
  "Manager",
  new Schema({
    ...commonDetails,
    downLineEmployees: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
    },
  })
);

const Employee = User.discriminator("Employee", new Schema(commonDetails));

//--- USER NOTICES SCHEMA ---
const noticeSchema = new Schema(
  {
    notice: {
      type: String,
      required: true,
      uppercase: true,
    },
  },
  { timestamps: true }
);

const Notice = model("Notice", noticeSchema);

export { User, Manager, Employee, Notice };
