/** Download a public wallet configuration without sending it to a server. */
export function downloadJson(filename: string, value: unknown): void {
	const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.append(link);
	try {
		link.click();
	} finally {
		link.remove();
		// Let the browser start the download before releasing its object URL.
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
}
