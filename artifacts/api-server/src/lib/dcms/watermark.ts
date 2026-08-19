import { v2 as cloudinary } from "cloudinary";

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary credentials not configured");
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  return { cloudName, apiKey, apiSecret };
}

export type WatermarkInput = {
  imageBase64: string;
  dateTime: string;
  vehicleNumber?: string;
  latitude: number;
  longitude: number;
  staffName: string;
  /** Shown on the photo strip, e.g. CAR NOT AVAILABLE */
  outcomeLabel?: string;
  tags?: string[];
  folder?: string;
};

function buildWatermarkText(input: WatermarkInput): string {
  const coords = `${input.latitude.toFixed(6)}, ${input.longitude.toFixed(6)}`;
  return [
    input.outcomeLabel,
    input.dateTime,
    input.vehicleNumber,
    coords,
    input.staffName,
  ].filter((part): part is string => Boolean(part)).join(" | ");
}

/**
 * Upload image with server-side text watermark via Cloudinary transformation.
 */
export async function uploadWatermarkedVisitPhoto(input: WatermarkInput): Promise<string> {
  getCloudinaryConfig();
  const folder = input.folder ?? process.env.CLOUDINARY_FOLDER ?? "cwp/dcms-visits";
  const watermarkText = buildWatermarkText(input);

  const dataUri = input.imageBase64.startsWith("data:")
    ? input.imageBase64
    : `data:image/jpeg;base64,${input.imageBase64}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: "image",
    ...(input.tags?.length ? { tags: input.tags } : {}),
    ...(input.outcomeLabel ? { context: `outcome=${input.outcomeLabel.replace(/\s+/g, "_")}` } : {}),
    transformation: [
      {
        overlay: {
          font_family: "Arial",
          font_size: 16,
          font_weight: "bold",
          text: watermarkText,
        },
        gravity: "south",
        y: 15,
        color: "white",
        background: "black",
        opacity: 80,
      },
    ],
  });

  return result.secure_url;
}
