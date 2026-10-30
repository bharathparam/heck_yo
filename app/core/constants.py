import enum


class UserRole(str, enum.Enum):
    PASSENGER = "PASSENGER"
    CONDUCTOR = "CONDUCTOR"
    OPERATOR = "OPERATOR"
    ADMIN = "ADMIN"


class TripStatus(str, enum.Enum):
    AGGREGATING = "AGGREGATING"          # Accumulating bookings (<20)
    THRESHOLD_MET = "THRESHOLD_MET"      # 20 confirmed bookings reached, awaiting operator assignment
    SCHEDULED = "SCHEDULED"              # Bus & Conductor assigned, ready
    BOARDING = "BOARDING"                # Conductor has opened boarding window
    DEPARTED = "DEPARTED"                # Bus departed
    COMPLETED = "COMPLETED"              # Trip completed at destination
    CANCELLED = "CANCELLED"              # Trip cancelled (demand not met or operator cancelled)


class BookingStatus(str, enum.Enum):
    PENDING_PAYMENT = "PENDING_PAYMENT"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"


class PaymentStatus(str, enum.Enum):
    INITIATED = "INITIATED"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"


class TicketStatus(str, enum.Enum):
    ISSUED = "ISSUED"
    BOARDED = "BOARDED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class BusStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    MAINTENANCE = "MAINTENANCE"
    INACTIVE = "INACTIVE"


class TrainArrivalStatus(str, enum.Enum):
    ON_TIME = "ON_TIME"
    DELAYED = "DELAYED"
    CANCELLED = "CANCELLED"
