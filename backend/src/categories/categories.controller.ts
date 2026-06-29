import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CategoriesService } from './categories.service';
import { BulkActivateCategoriesDto, CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';

@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Get('presets')
  getPresets() {
    return this.service.getPresets();
  }

  @Get()
  getCategories(@Request() req: any) {
    return this.service.getUserCategories(req.user.id);
  }

  @Post('bulk')
  bulkActivate(@Request() req: any, @Body() dto: BulkActivateCategoriesDto) {
    return this.service.bulkActivate(req.user.id, dto);
  }

  @Post()
  create(@Request() req: any, @Body() dto: CreateCategoryDto) {
    return this.service.create(req.user.id, dto);
  }

  @Patch(':id')
  update(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.service.update(req.user.id, id, dto);
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(req.user.id, id);
  }
}
