Pod::Spec.new do |s|
  s.name           = 'VaineFaceDetection'
  s.version        = '1.0.0'
  s.summary        = 'On-device ML Kit face detection for vAIne capture alignment'
  s.description    = 'Still-image face bounds and landmarks for facial-zone alignment and crop calculations. Accurate mode; contours, classification, and tracking disabled. No identity recognition, embeddings, or off-device processing.'
  s.author         = 'vAIne'
  s.homepage       = 'https://github.com/HolisticDrBright/vAIne'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.5' }
  s.swift_version  = '5.9'
  s.source         = { :git => 'https://github.com/HolisticDrBright/vAIne.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # Pinned exact for reproducible EAS builds; GoogleMLKit 8.0.0 requires iOS 15.5+.
  s.dependency 'GoogleMLKit/FaceDetection', '8.0.0'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,swift}'
end
