import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * Local Expo module wrapping the official Google ML Kit face-detection SDKs.
 *
 * Scope is deliberately narrow: still-image face bounds and landmark points
 * for capture alignment and crop calculations, fully on-device. The native
 * layers configure ML Kit with accurate mode, landmarks on, and contours,
 * classification (smiling/eyes-open), and tracking OFF. Nothing here performs
 * identity recognition, identity matching, embeddings, demographic inference,
 * or emotion classification, and no image or geometry leaves the device.
 */

export interface VaineFacePoint {
  x: number;
  y: number;
}

export interface VaineDetectedFace {
  frame: { x: number; y: number; width: number; height: number };
  landmarks: {
    leftEye?: VaineFacePoint;
    rightEye?: VaineFacePoint;
    noseBase?: VaineFacePoint;
    mouthLeft?: VaineFacePoint;
    mouthRight?: VaineFacePoint;
    mouthBottom?: VaineFacePoint;
  };
}

export interface VaineDetectionPayload {
  /** Pixel dimensions of the orientation-normalized image the detector ran on. */
  imageWidth: number;
  imageHeight: number;
  faces: VaineDetectedFace[];
}

interface VaineFaceDetectionNativeModule {
  detectFaces(imageUri: string): Promise<VaineDetectionPayload>;
}

const nativeModule = requireOptionalNativeModule<VaineFaceDetectionNativeModule>('VaineFaceDetection');

export function isFaceDetectionAvailable(): boolean {
  return nativeModule != null;
}

export async function detectFacesNative(imageUri: string): Promise<VaineDetectionPayload> {
  if (!nativeModule) {
    throw new Error('VaineFaceDetection native module is not available in this build.');
  }
  return nativeModule.detectFaces(imageUri);
}
