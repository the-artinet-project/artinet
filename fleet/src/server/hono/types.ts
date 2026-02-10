/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import * as hono from 'hono';

export type Session = {
    ctx: hono.Context;
    next: hono.Next;
};
