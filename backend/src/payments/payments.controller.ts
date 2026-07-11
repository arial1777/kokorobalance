import { Controller, Headers, Post, Req, Request, UseGuards } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Post('create-checkout')
  @UseGuards(SupabaseAuthGuard)
  createCheckout(@Request() req: any) {
    return this.service.createCheckoutSession(req.user.id, req.user.email);
  }

  @Post('portal')
  @UseGuards(SupabaseAuthGuard)
  createPortal(@Request() req: any) {
    return this.service.createPortalSession(req.user.id);
  }

  @Post('webhook')
  handleWebhook(
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Headers('stripe-signature') sig: string,
  ) {
    return this.service.handleWebhook(req, sig);
  }
}
