import mongoose, { Document, Model, Schema } from "mongoose";

export interface ICustomModel {
  id: string;
  label: string;
}

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  customModels: ICustomModel[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    customModels: {
      type: [
        new Schema<ICustomModel>(
          {
            id: { type: String, required: true, trim: true, maxlength: 100 },
            label: { type: String, required: true, trim: true, maxlength: 40 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);


const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
