import { storageRef } from "../db/firebase.storage.js";
import fs from "fs";
import util from "util";

// Promisify fs.readFile to use async/await
const readFileAsync = util.promisify(fs.readFile);

async function uploadImageToFirebase(filePath, folderName = "work_images") {
  try {
    // Read the file from the file system
    const fileData = await readFileAsync(filePath);

    // Create a blob from the file data
    const fileBlob = new Blob([fileData]);

    // Generate a unique name for the image
    const date = new Date();
    const imageName = `image_${date.getTime()}.jpg`;

    // Define the folder path for the upload
    const folderPath = `images/${imageName}`;

    // Upload the file to the specific folder
    const uploadTask = storageRef.child(folderPath).put(fileBlob, {
      contentType: "image/jpg",
    });

    // Wait for the upload to complete
    const snapshot = await uploadTask;

    // Get the download URL of the uploaded file
    const downloadURL = await snapshot.ref.getDownloadURL();

    // Remove the file from the local file system after uploading
    fs.unlinkSync(filePath);

    return downloadURL;
  } catch (error) {
    console.error("Error uploading image:", error);
    throw error;
  }
}

export { uploadImageToFirebase };
