import ExpoModulesCore
import Foundation
import MLKitFaceDetection
import MLKitVision
import UIKit

/**
 Still-image face detection for capture alignment.

 ML Kit is configured for accurate single-shot analysis with landmarks only:
 contours, classification (smiling / eyes-open), and tracking stay disabled so
 the module cannot produce identity, demographic, or emotion signals. The
 image is orientation-normalized before detection and the payload reports the
 exact pixel dimensions the detector measured in, so JavaScript never has to
 guess the coordinate space.
 */
public class VaineFaceDetectionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VaineFaceDetection")

    AsyncFunction("detectFaces") { (imageUri: String) -> [String: Any] in
      guard let url = URL(string: imageUri), url.isFileURL,
            let originalImage = UIImage(contentsOfFile: url.path) else {
        throw ImageLoadException(imageUri)
      }

      let image = Self.normalizedOrientation(originalImage)
      let visionImage = VisionImage(image: image)
      visionImage.orientation = .up

      let options = FaceDetectorOptions()
      options.performanceMode = .accurate
      options.landmarkMode = .all
      options.contourMode = .none
      options.classificationMode = .none
      options.isTrackingEnabled = false
      options.minFaceSize = 0.15

      let detector = FaceDetector.faceDetector(options: options)
      let faces = try detector.results(in: visionImage)

      let pixelWidth = image.size.width * image.scale
      let pixelHeight = image.size.height * image.scale

      let landmarkTypes: [(String, FaceLandmarkType)] = [
        ("leftEye", .leftEye),
        ("rightEye", .rightEye),
        ("noseBase", .noseBase),
        ("mouthLeft", .mouthLeft),
        ("mouthRight", .mouthRight),
        ("mouthBottom", .mouthBottom),
      ]

      return [
        "imageWidth": pixelWidth,
        "imageHeight": pixelHeight,
        "faces": faces.map { face -> [String: Any] in
          var landmarks: [String: Any] = [:]
          for (key, type) in landmarkTypes {
            if let landmark = face.landmark(ofType: type) {
              landmarks[key] = ["x": landmark.position.x, "y": landmark.position.y]
            }
          }
          return [
            "frame": [
              "x": face.frame.origin.x,
              "y": face.frame.origin.y,
              "width": face.frame.size.width,
              "height": face.frame.size.height,
            ],
            "landmarks": landmarks,
          ]
        },
      ]
    }
  }

  /// Re-renders the image upright so detector coordinates and the reported
  /// dimensions share one EXIF-independent pixel space.
  private static func normalizedOrientation(_ image: UIImage) -> UIImage {
    if image.imageOrientation == .up {
      return image
    }
    UIGraphicsBeginImageContextWithOptions(image.size, false, image.scale)
    defer { UIGraphicsEndImageContext() }
    image.draw(in: CGRect(origin: .zero, size: image.size))
    return UIGraphicsGetImageFromCurrentImageContext() ?? image
  }
}

internal final class ImageLoadException: GenericException<String> {
  override var reason: String {
    "Could not load an image from the local file URI: \(param)"
  }
}
