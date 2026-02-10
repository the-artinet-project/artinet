/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';

export type Session = {
    request: express.Request;
    response: express.Response;
    next: express.NextFunction;
};
