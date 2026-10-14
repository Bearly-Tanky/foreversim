import { LandingClassGrid } from './LandingClassGrid';
import { LandingForever, LandingProductLinks } from './LandingForever';
import { LandingHeader } from './LandingHeader';

export const LandingPage = () => (
	<>
		<div className="fixed -z-1 h-full w-full bg-landing bg-cover bg-center bg-no-repeat opacity-30 max-md:bg-landing-sm" />
		<div id="homepage" className="flex h-full flex-col">
			<LandingHeader />
			<main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-12">
				<div className="flex flex-col gap-2">
					<h1 className="m-0 text-3xl font-bold">How much damage does your character do?</h1>
					<p className="m-0 text-lg text-gray-300">
						Pick your class to start. Choose your gear, talents and race, press Simulate, and see what each change is worth.
					</p>
				</div>
				<LandingClassGrid />
				<details className="rounded-xl border border-surface-border bg-panel px-4 py-3 backdrop-blur-sm">
					<summary className="cursor-pointer text-lg font-bold">About this simulator, and more tools</summary>
					<div className="flex flex-col gap-4 pt-4">
						<LandingForever />
						<LandingProductLinks />
					</div>
				</details>
			</main>
		</div>
	</>
);
