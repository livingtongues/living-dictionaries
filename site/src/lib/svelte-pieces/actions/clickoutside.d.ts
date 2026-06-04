/// <reference types="svelte" />
import type { ActionReturn } from 'svelte/action';
interface Attributes {
    'on:clickoutside'?: (e: CustomEvent<boolean>) => void;
}
export declare function clickoutside(node: Node): ActionReturn<undefined, Attributes>;
export {};
