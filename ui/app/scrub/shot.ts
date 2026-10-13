// Takes a screenshot to PNG bytes with nothing else attached.
//
// A screenshot cannot be scrubbed the way DamageMeter.bin is - a name in the picture is
// pixels, and there is no honest way to promise it has been found. What can be promised is
// everything the file carries *around* the picture: EXIF, GPS, camera, editor history, the
// thumbnail that survives cropping in some tools. Decoding to a bitmap and re-encoding keeps
// exactly the pixels and nothing else, because the encoder writes a fresh file from scratch.
//
// So the page's own warning has to stand on its own: crop to the tooltip. This only
// guarantees that the bytes say no more than the picture does.

export async function toCleanPng(file: File): Promise<Uint8Array> {
	// Throws on anything that is not a decodable image, which is the type check as well.
	const bitmap = await createImageBitmap(file);
	try {
		// Native resolution: a tooltip that has been downscaled can be unreadable, and this is
		// being sent precisely so someone can read it.
		const canvas = document.createElement('canvas');
		canvas.width = bitmap.width;
		canvas.height = bitmap.height;
		canvas.getContext('2d')!.drawImage(bitmap, 0, 0);

		const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
		if (!blob) throw new Error('could not re-encode that image');
		return new Uint8Array(await blob.arrayBuffer());
	} finally {
		bitmap.close();
	}
}
