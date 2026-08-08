import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CategoriesService } from './categories.service';
import { PillarsService } from './pillars.service';
import {
  BulkActivateCategoriesDto,
  BulkCreateCategoriesDto,
  CreateCategoryDto,
  DeclareVerificationDto,
  UpdateCategoryDto,
} from './dto/create-category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly service: CategoriesService,
    private readonly pillars: PillarsService,
  ) {}

  @Get('presets')
  getPresets() {
    return this.service.getPresets();
  }

  @Get()
  @UseGuards(SupabaseAuthGuard)
  getCategories(@Request() req: any) {
    return this.service.getUserCategories(req.user.id);
  }

  @Post('bulk')
  @UseGuards(SupabaseAuthGuard)
  bulkActivate(@Request() req: any, @Body() dto: BulkActivateCategoriesDto) {
    return this.service.bulkActivate(req.user.id, req.user.email, dto);
  }

  /** オンボーディングで柱をまとめて登録する（07 §4.1） */
  @Post('bulk-create')
  @UseGuards(SupabaseAuthGuard)
  bulkCreate(@Request() req: any, @Body() dto: BulkCreateCategoriesDto) {
    return this.service.bulkCreate(req.user.id, req.user.email, dto);
  }

  // 柱の登録は Free でも全機能使える（10-pricing-b2b.md §2.3「柱（3型・承認）」は Free ○）。
  // 自分の言葉でラベルを付けられること自体が新しいモデルの根幹なので Pro ゲートを掛けない（07 P-10）
  @Post()
  @UseGuards(SupabaseAuthGuard)
  create(@Request() req: any, @Body() dto: CreateCategoryDto) {
    return this.service.create(req.user.id, req.user.email, dto);
  }

  @Patch(':id')
  @UseGuards(SupabaseAuthGuard)
  update(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.service.update(req.user.id, id, dto);
  }

  /** 「そこにいる人たちも、あなたがそこにいると思っていそうですか？」への回答（07 §3.3） */
  @Post(':id/verification')
  @UseGuards(SupabaseAuthGuard)
  declareVerification(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeclareVerificationDto,
  ) {
    return this.pillars.declareVerification(req.user.id, id, dto.answer);
  }

  @Delete(':id')
  @UseGuards(SupabaseAuthGuard)
  remove(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(req.user.id, id);
  }
}
