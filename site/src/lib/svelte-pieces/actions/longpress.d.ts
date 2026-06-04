/// <reference types="svelte" />
import type { ActionReturn } from 'svelte/action';
interface Attributes {
    'on:shortpress'?: (e: CustomEvent<boolean>) => void;
    'on:longpress'?: (e: CustomEvent<boolean>) => void;
}
export declare function longpress(node: Node, duration?: number): ActionReturn<number, Attributes>;
export {};
