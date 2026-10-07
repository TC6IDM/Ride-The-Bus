import { setContextEventEmitter, getContextEventEmitter } from 'utils-event-emitter';
import { setContextXstate, getContextXstate } from 'utils-xstate';
import { setContextLayout, getContextLayout } from 'utils-layout';
// No pixi-svelte here - see stateApp.ts. Its set/getContextApp registered a
// Svelte context that nothing in this game reads, at the cost of bundling
// PixiJS and Spine.

import { eventEmitter, type EmitterEvent } from './eventEmitter';
import { stateXstate, stateXstateDerived } from './stateXstate';
import { stateLayout, stateLayoutDerived } from './stateLayout';
import { stateApp } from './stateApp';

import { i18nDerived } from '../../i18n/i18nDerived';

export const setContext = () => {
	setContextEventEmitter<EmitterEvent>({ eventEmitter });
	setContextXstate({ stateXstate, stateXstateDerived });
	setContextLayout({ stateLayout, stateLayoutDerived });
};

export const getContext = () => ({
	...getContextEventEmitter<EmitterEvent>(),
	...getContextLayout(),
	...getContextXstate(),
	stateApp,
	i18nDerived,
});
