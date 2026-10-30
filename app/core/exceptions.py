from fastapi import HTTPException, status


class DomainException(HTTPException):
    def __init__(self, status_code: int, detail: str, error_code: str = "ERROR"):
        super().__init__(status_code=status_code, detail={"error": detail, "code": error_code})


class EntityNotFoundException(DomainException):
    def __init__(self, entity_name: str, identifier: str = ""):
        detail = f"{entity_name} {identifier} not found" if identifier else f"{entity_name} not found"
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail, error_code="NOT_FOUND")


class UnauthorizedException(DomainException):
    def __init__(self, detail: str = "Could not validate credentials"):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail, error_code="UNAUTHORIZED")


class ForbiddenException(DomainException):
    def __init__(self, detail: str = "You do not have permission to perform this action"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail, error_code="FORBIDDEN")


class InvalidTicketException(DomainException):
    def __init__(self, detail: str = "Ticket is invalid or signature mismatch"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail, error_code="INVALID_TICKET")


class AlreadyBoardedException(DomainException):
    def __init__(self, detail: str = "Ticket has already been boarded"):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail, error_code="ALREADY_BOARDED")


class InvalidStateTransitionException(DomainException):
    def __init__(self, current_state: str, attempted_state: str):
        detail = f"Cannot transition trip from {current_state} to {attempted_state}"
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail, error_code="INVALID_TRANSITION")


class TripCapacityExceededException(DomainException):
    def __init__(self, detail: str = "Bus capacity exceeded for this trip"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail, error_code="CAPACITY_EXCEEDED")
