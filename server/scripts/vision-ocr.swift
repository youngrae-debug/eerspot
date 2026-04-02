import AppKit
import CoreImage
import CoreImage.CIFilterBuiltins
import Foundation
import Vision

typealias JsonObject = [String: [String]]

let arguments = CommandLine.arguments

guard arguments.count >= 2 else {
  FileHandle.standardOutput.write(
    Data("{\"lines\":[]}\n".utf8),
  )
  exit(0)
}

let imagePath = arguments[1]

guard
  let image = NSImage(contentsOfFile: imagePath),
  let tiffRepresentation = image.tiffRepresentation,
  let bitmap = NSBitmapImageRep(data: tiffRepresentation),
  let baseImage = CIImage(bitmapImageRep: bitmap)
else {
  FileHandle.standardOutput.write(
    Data("{\"lines\":[]}\n".utf8),
  )
  exit(0)
}

let context = CIContext(options: nil)

func recognizeLines(from image: CIImage, minimumTextHeight: Float) -> [String] {
  guard let cgImage = context.createCGImage(image, from: image.extent) else {
    return []
  }

  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = true
  request.recognitionLanguages = ["ko-KR", "en-US"]
  request.minimumTextHeight = minimumTextHeight

  let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

  do {
    try handler.perform([request])
  } catch {
    return []
  }

  return (request.results ?? []).compactMap { observation in
    observation.topCandidates(1).first?.string.trimmingCharacters(
      in: .whitespacesAndNewlines,
    )
  }
}

func scale(_ image: CIImage, x: CGFloat, y: CGFloat) -> CIImage {
  image.transformed(by: CGAffineTransform(scaleX: x, y: y))
}

func monochromeContrast(_ image: CIImage, contrast: Float, brightness: Float) -> CIImage {
  let colorControls = CIFilter.colorControls()
  colorControls.inputImage = image
  colorControls.saturation = 0
  colorControls.contrast = contrast
  colorControls.brightness = brightness
  return colorControls.outputImage ?? image
}

func appendLines(_ values: [String], to target: inout [String]) {
  for value in values where !value.isEmpty && !target.contains(value) {
    target.append(value)
  }
}

func collectFullImageLines(from image: CIImage) -> [String] {
  var lines: [String] = []

  appendLines(
    recognizeLines(from: scale(image, x: 2, y: 2), minimumTextHeight: 0.01),
    to: &lines,
  )
  appendLines(
    recognizeLines(
      from: monochromeContrast(scale(image, x: 3, y: 3), contrast: 2.6, brightness: 0.1),
      minimumTextHeight: 0.008,
    ),
    to: &lines,
  )

  return lines
}

func collectGridLabelLines(from image: CIImage) -> [String] {
  var lines: [String] = []

  let columns: CGFloat = 3
  let rows: CGFloat = 3
  let cellWidth = image.extent.width / columns
  let cellHeight = image.extent.height / rows

  for row in 0..<Int(rows) {
    for column in 0..<Int(columns) {
      let originX = CGFloat(column) * cellWidth
      let originY = image.extent.height - (CGFloat(row) + 1) * cellHeight
      let labelRect = CGRect(
        x: originX + cellWidth * 0.02,
        y: originY + cellHeight * 0.02,
        width: cellWidth * 0.96,
        height: cellHeight * 0.24,
      )
      let cropped = image.cropped(to: labelRect)
      let strongContrast = monochromeContrast(
        scale(cropped, x: 6, y: 6),
        contrast: 4.0,
        brightness: 0.18,
      )
      let softContrast = monochromeContrast(
        scale(cropped, x: 5, y: 5),
        contrast: 3.1,
        brightness: 0.08,
      )

      appendLines(
        recognizeLines(from: strongContrast, minimumTextHeight: 0.03),
        to: &lines,
      )
      appendLines(
        recognizeLines(from: softContrast, minimumTextHeight: 0.028),
        to: &lines,
      )
    }
  }

  return lines
}

var collectedLines: [String] = []
let labelLines = collectGridLabelLines(from: baseImage)

appendLines(labelLines, to: &collectedLines)
appendLines(collectFullImageLines(from: baseImage), to: &collectedLines)

let payload: JsonObject = [
  "lines": collectedLines,
]

let encoder = JSONEncoder()

guard let output = try? encoder.encode(payload) else {
  FileHandle.standardOutput.write(
    Data("{\"lines\":[]}\n".utf8),
  )
  exit(0)
}

FileHandle.standardOutput.write(output)
FileHandle.standardOutput.write(Data("\n".utf8))
