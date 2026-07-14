import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ProPlanGuard } from '../auth/pro-plan.guard';
import { CategoriesService } from './categories.service';
import { BulkActivateCategoriesDto, CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

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

  @Post()
  @UseGuards(SupabaseAuthGuard, ProPlanGuard)
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

  @Delete(':id')
  @UseGuards(SupabaseAuthGuard)
  remove(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(req.user.id, id);
  }
}
