import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class MasterJwtAuthGuard extends AuthGuard('master-jwt') {}
