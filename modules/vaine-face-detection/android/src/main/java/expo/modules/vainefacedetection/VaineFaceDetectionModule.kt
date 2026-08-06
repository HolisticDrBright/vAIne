package expo.modules.vainefacedetection

import android.net.Uri
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.face.FaceLandmark
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Still-image face detection for capture alignment.
 *
 * ML Kit runs in accurate mode with landmarks only: contours, classification
 * (smiling / eyes-open), and tracking stay disabled so the module cannot
 * produce identity, demographic, or emotion signals. InputImage.fromFilePath
 * applies EXIF rotation; coordinates are reported in the upright space, and
 * the payload carries the upright pixel dimensions so JavaScript never has to
 * guess the coordinate space.
 */
class VaineFaceDetectionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VaineFaceDetection")

    AsyncFunction("detectFaces") { imageUri: String ->
      val context = appContext.reactContext
        ?: throw CodedException("ERR_VAINE_FACE_DETECTION", "React context is unavailable.", null)

      val image = InputImage.fromFilePath(context, Uri.parse(imageUri))
      val options = FaceDetectorOptions.Builder()
        .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
        .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_ALL)
        .setContourMode(FaceDetectorOptions.CONTOUR_MODE_NONE)
        .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_NONE)
        .setMinFaceSize(0.15f)
        .build()

      val detector = FaceDetection.getClient(options)
      try {
        val faces = Tasks.await(detector.process(image))
        val rotated = image.rotationDegrees == 90 || image.rotationDegrees == 270
        val uprightWidth = if (rotated) image.height else image.width
        val uprightHeight = if (rotated) image.width else image.height

        val landmarkTypes = mapOf(
          "leftEye" to FaceLandmark.LEFT_EYE,
          "rightEye" to FaceLandmark.RIGHT_EYE,
          "noseBase" to FaceLandmark.NOSE_BASE,
          "mouthLeft" to FaceLandmark.MOUTH_LEFT,
          "mouthRight" to FaceLandmark.MOUTH_RIGHT,
          "mouthBottom" to FaceLandmark.MOUTH_BOTTOM,
        )

        mapOf(
          "imageWidth" to uprightWidth,
          "imageHeight" to uprightHeight,
          "faces" to faces.map { face ->
            val landmarks = mutableMapOf<String, Map<String, Float>>()
            for ((key, type) in landmarkTypes) {
              face.getLandmark(type)?.let { landmark ->
                landmarks[key] = mapOf("x" to landmark.position.x, "y" to landmark.position.y)
              }
            }
            mapOf(
              "frame" to mapOf(
                "x" to face.boundingBox.left,
                "y" to face.boundingBox.top,
                "width" to face.boundingBox.width(),
                "height" to face.boundingBox.height(),
              ),
              "landmarks" to landmarks,
            )
          },
        )
      } finally {
        detector.close()
      }
    }
  }
}
