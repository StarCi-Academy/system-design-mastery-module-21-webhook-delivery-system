import { Controller, Get, Query } from "@nestjs/common"
import { CircuitService } from "./circuit.service"

@Controller("api/circuit")
export class CircuitController {
    constructor(private readonly circuit: CircuitService) {}

    @Get("status")
    status(@Query("host") host: string) {
        return this.circuit.status(host)
    }
}
