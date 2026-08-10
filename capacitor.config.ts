import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'io.axoneo.satsight',
	appName: 'SatSight',
	webDir: 'build',
	server: {
		androidScheme: 'https'
	},
	plugins: {
		StatusBar: {
			style: 'LIGHT',
			backgroundColor: '#0b0d10'
		}
	}
};

export default config;
