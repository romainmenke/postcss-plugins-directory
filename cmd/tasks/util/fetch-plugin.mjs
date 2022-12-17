export async function fetchPlugin(name) {
	const response = await fetch(`https://registry.npmjs.org/${name}`);
	if (response.status !== 200) {
		throw new Error(`Fetching detailed plugin data : ${response.statusText}`);
	}

	return await response.json();
}
